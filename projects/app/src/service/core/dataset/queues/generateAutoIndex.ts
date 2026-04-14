import { MongoDatasetTraining } from '@fastgpt/service/core/dataset/training/schema';
import { pushLLMTrainingUsage } from '@fastgpt/service/support/wallet/usage/controller';
import { TrainingModeEnum } from '@fastgpt/global/core/dataset/constants';
import { getLogger, LogCategories } from '@fastgpt/service/common/logger';
import { createLLMResponse } from '@fastgpt/service/core/ai/llm/request';
import { UsageItemTypeEnum } from '@fastgpt/global/support/wallet/usage/constants';
import { getLLMModel } from '@fastgpt/service/core/ai/model';
import { checkTeamAiPointsAndLock } from './utils';
import { addMinutes } from 'date-fns';
import { delay } from '@fastgpt/service/common/bullmq';

const logger = getLogger(LogCategories.MODULE.DATASET.QUEUES);

const reduceQueue = () => {
  global.autoIndexQueueLen = global.autoIndexQueueLen > 0 ? global.autoIndexQueueLen - 1 : 0;
  return global.autoIndexQueueLen === 0;
};

type PopulateType = {
  dataset: { agentModel: string };
};

export async function generateAutoIndex(): Promise<any> {
  const max = global.systemEnv?.qaMaxProcess || 10;

  global.autoIndexQueueLen = global.autoIndexQueueLen || 0;
  logger.debug('AutoIndex queue size check', { queueSize: global.autoIndexQueueLen, max });

  if (global.autoIndexQueueLen >= max) return;
  global.autoIndexQueueLen++;

  try {
    while (true) {
      const startTime = Date.now();

      const {
        data,
        done = false,
        error = false
      } = await (async () => {
        try {
          const data = await MongoDatasetTraining.findOneAndUpdate(
            {
              mode: TrainingModeEnum.auto,
              retryCount: { $gt: 0 },
              lockTime: { $lte: addMinutes(new Date(), -10) }
            },
            {
              lockTime: new Date(),
              $inc: { retryCount: -1 }
            }
          )
            .populate<PopulateType>([
              {
                path: 'dataset',
                select: 'agentModel'
              }
            ])
            .lean();

          if (!data) return { done: true };
          return { data };
        } catch (error) {
          return { error: true };
        }
      })();

      if (done || !data) break;
      if (error) {
        logger.error('AutoIndex queue fetch task failed', { error });
        await delay(500);
        continue;
      }

      if (!data.dataset) {
        logger.info('AutoIndex queue task skipped: dataset missing', {
          datasetId: data.datasetId,
          collectionId: data.collectionId,
          trainingId: data._id
        });
        await MongoDatasetTraining.deleteOne({ _id: data._id });
        continue;
      }

      if (!(await checkTeamAiPointsAndLock(data.teamId))) {
        continue;
      }

      logger.info('AutoIndex queue task started', {
        trainingId: data._id,
        datasetId: data.datasetId,
        collectionId: data.collectionId,
        teamId: data.teamId,
        tmbId: data.tmbId
      });

      try {
        const modelData = getLLMModel(data.dataset.agentModel);
        if (!modelData?.model) {
          throw new Error('LLM model not configured');
        }

        const prompt =
          '作为一个领域的专家，请为以下给定的文本段落生成一段简短的核心摘要，以及3个可能由用户提出的与之相关的问题。你的输出应该纯粹包含生成的文本内容，不要包含任何多余的解释、寒暄或格式化的前缀。\n\n文本内容：\n' +
          (data.q || '');

        const {
          answerText,
          usage: { inputTokens = 0, outputTokens = 0 } = {}
        } = await createLLMResponse({
          body: {
            model: modelData.model,
            temperature: 0.2,
            messages: [{ role: 'user', content: prompt }]
          }
        });

        const extraText = (answerText || '').trim();
        if (extraText) {
          await MongoDatasetTraining.updateOne(
            { _id: data._id },
            {
              $push: {
                indexes: {
                  type: 'custom',
                  text: extraText
                }
              }
            }
          );

          pushLLMTrainingUsage({
            teamId: data.teamId,
            inputTokens,
            outputTokens,
            usageId: data.billId,
            model: modelData.model,
            type: UsageItemTypeEnum.training_qa
          });
        }

        await MongoDatasetTraining.updateOne(
          { _id: data._id },
          { mode: TrainingModeEnum.chunk, lockTime: new Date('2000/1/1') }
        );

        logger.info('AutoIndex queue task finished', {
          durationMs: Date.now() - startTime,
          usage: { inputTokens, outputTokens },
          trainingId: data._id,
          datasetId: data.datasetId,
          collectionId: data.collectionId
        });
      } catch (err: any) {
        logger.error('AutoIndex queue task failed', {
          error: err,
          trainingId: data._id,
          datasetId: data.datasetId,
          collectionId: data.collectionId
        });
        await MongoDatasetTraining.updateOne(
          { _id: data._id },
          { errorMsg: err?.message || 'unknown error', lockTime: new Date('2000/1/1') }
        );
        await delay(100);
      }
    }
  } catch (error) {
    logger.error('AutoIndex queue loop failed', { error });
  }

  if (reduceQueue()) {
    logger.info('AutoIndex queue drained', { queueSize: global.autoIndexQueueLen });
  }
  logger.debug('AutoIndex queue loop exit', { queueSize: global.autoIndexQueueLen });
}
