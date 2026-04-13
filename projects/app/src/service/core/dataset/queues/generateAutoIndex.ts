import { getLLMModel } from '@fastgpt/service/core/ai/model';
import { MongoDatasetData } from '@fastgpt/service/core/dataset/data/schema';
import { MongoDatasetTraining } from '@fastgpt/service/core/dataset/training/schema';
import { pushLLMTrainingUsage } from '@fastgpt/service/support/wallet/usage/controller';
import { UsageItemTypeEnum } from '@fastgpt/global/support/wallet/usage/constants';
import { createLLMResponse } from '@fastgpt/service/core/ai/llm/request';
import { TrainingModeEnum } from '@fastgpt/global/core/dataset/constants';
import { getLogger, LogCategories } from '@fastgpt/service/common/logger';

const logger = getLogger(LogCategories.MODULE.DATASET.QUEUES);

export const generateAutoIndex = async () => {
  let success = false;

  try {
    if (!global.systemEnv?.qaMaxProcess) return;
    const maxProcess = global.systemEnv.qaMaxProcess;

    const dataList = await MongoDatasetTraining.find({
      mode: TrainingModeEnum.auto,
      lockTime: { $lte: new Date(Date.now() - 5 * 60 * 1000) }
    }).limit(maxProcess);

    if (dataList.length === 0) return;

    for (const data of dataList) {
      success = true;
      try {
        await MongoDatasetTraining.updateOne(
          { _id: data._id },
          { lockTime: new Date() }
        );

        if (data.q) {
          const modelInfo = getLLMModel(data.model as unknown as string);

          // Build Prompt
          const prompt = '作为一个领域的专家，请为以下给定的文本段落生成一段简短的核心摘要，以及3个可能由用户提出的与之相关的问题。你的输出应该纯粹包含生成的文本内容，不要包含任何多余的解释、寒暄或格式化的前缀。\n\n文本内容：\n' + data.q;

          // Request LLM
          const response = await createLLMResponse({
              body: {
                model: data.model as unknown as string,
                messages: [{ role: 'user', content: prompt }]
              }
            });

          const extraText = (response.answerText || '').trim();
          if (extraText) {
            await MongoDatasetData.updateOne(
              { _id: data.dataId },
              {
                $push: {
                  indexes: {
                    defaultIndex: false,
                    type: 'custom',
                    text: extraText
                  }
                }
              }
            );

            // Record usage token
            if (response.usage && data.tmbId && data.teamId) {
              pushLLMTrainingUsage({
                teamId: data.teamId,
                inputTokens: response.usage?.inputTokens || 0,
                outputTokens: response.usage?.outputTokens || 0,
                model: data.model as unknown as string,
                usageId: data.billId,
                type: UsageItemTypeEnum.training_qa
              });
            }
          }
        }

        // Change mode to chunk to proceed to vector generation queue
        await MongoDatasetTraining.updateOne(
          { _id: data._id },
          { mode: TrainingModeEnum.chunk, lockTime: new Date('2000/1/1') }
        );
      } catch (error) {
        logger.error('Error generating auto index for chunk', { error });
        await MongoDatasetTraining.updateOne(
          { _id: data._id },
          { lockTime: new Date('2000/1/1') }
        );
      }
    }
  } catch (error) {
    logger.error('Auto index generator error', { error });
  }

  if (success) {
    setTimeout(generateAutoIndex, 100);
  }
};
