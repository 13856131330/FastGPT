import { getLogger, LogCategories } from '../../../../common/logger';

export type SubmitPaddleOcrJobParams = {
  buffer: Buffer;
  filename: string;
  token: string;
  jobUrl: string;
  model: string;
  optionalPayload?: Record<string, any>;
};

export type PollPaddleOcrJobParams = {
  jobId: string;
  token: string;
  jobUrl: string;
  pollIntervalMs: number;
  timeoutMs: number;
};

const logger = getLogger(LogCategories.MODULE.DATASET.QUEUES);

export const submitPaddleOcrJobByBuffer = async ({
  buffer,
  filename,
  token,
  jobUrl,
  model,
  optionalPayload = {
    useDocOrientationClassify: false,
    useDocUnwarping: false,
    useChartRecognition: false
  }
}: SubmitPaddleOcrJobParams): Promise<{ jobId: string }> => {
  const formData = new FormData();
  formData.append('model', model);
  formData.append('optionalPayload', JSON.stringify(optionalPayload));

  // Add the file buffer
  const fileBlob = new Blob([buffer]);
  formData.append('file', fileBlob, filename);

  const response = await fetch(jobUrl, {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`
    },
    body: formData as any
  });

  if (!response.ok) {
    const errText = await response.text();
    logger.error('Failed to submit PaddleOCR job', { status: response.status, errText });
    throw new Error(`Failed to submit PaddleOCR job: ${response.status} - ${errText}`);
  }

  const json = await response.json();
  if (json.code !== 0 || !json.data?.jobId) {
    throw new Error(`Invalid response from PaddleOCR: ${JSON.stringify(json)}`);
  }

  return { jobId: json.data.jobId };
};

export const pollPaddleOcrJobUntilDone = async ({
  jobId,
  token,
  jobUrl,
  pollIntervalMs,
  timeoutMs
}: PollPaddleOcrJobParams): Promise<{ jsonUrl: string }> => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const response = await fetch(`${jobUrl}/${jobId}`, {
      headers: {
        Authorization: `bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to poll PaddleOCR job: ${response.status}`);
    }

    const json = await response.json();
    const state = json.data?.state;

    if (state === 'done') {
      const jsonUrl = json.data?.resultUrl?.jsonUrl;
      if (!jsonUrl) {
        throw new Error('Job done but no jsonUrl found in response');
      }
      return { jsonUrl };
    }

    if (state === 'failed') {
      const errorMsg = json.data?.errorMsg || 'Unknown error';
      throw new Error(`PaddleOCR job failed: ${errorMsg}`);
    }

    // Pending or running, wait and retry
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`PaddleOCR polling timed out after ${timeoutMs}ms for job ${jobId}`);
};

export const downloadJsonlAndBuildMarkdown = async ({
  jsonUrl
}: {
  jsonUrl: string;
}): Promise<{ formatText: string }> => {
  const response = await fetch(jsonUrl);
  if (!response.ok) {
    throw new Error(`Failed to download PaddleOCR result JSONL: ${response.status}`);
  }

  const text = await response.text();
  const lines = text.trim().split('\n');

  let fullMarkdown = '';

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    try {
      const pageData = JSON.parse(trimmedLine);
      const results = pageData.result?.layoutParsingResults || [];

      for (const res of results) {
        if (res.markdown?.text) {
          let text = res.markdown.text;

          // 1. Remove all HTML img tags
          text = text.replace(/<img[^>]*>/g, '');
          // 2. Remove all Markdown image tags ![alt](url)
          text = text.replace(/!\[.*?\]\(.*?\)/g, '');
          // 3. Remove empty div tags (often left behind after removing images)
          text = text.replace(/<div[^>]*>\s*<\/div>/g, '');
          // 4. Remove any remaining div tags just to be safe, keeping their inner text
          text = text.replace(/<\/?div[^>]*>/g, '');

          fullMarkdown += text.trim() + '\n\n---\n\n';
        }
      }
    } catch (err) {
      logger.error('Failed to parse a line in PaddleOCR JSONL result', { err, line: trimmedLine });
    }
  }

  return { formatText: fullMarkdown.trim() };
};

export const processBufferWithPaddleOcr = async ({
  buffer,
  filename
}: {
  buffer: Buffer;
  filename: string;
}): Promise<{ formatText: string }> => {
  const token = process.env.PADDLE_OCR_TOKEN;
  if (!token) {
    throw new Error('PADDLE_OCR_TOKEN environment variable is not set');
  }

  const paddleOcrConfig = global.systemEnv?.customPdfParse?.paddleOcr || {};
  const jobUrl = paddleOcrConfig.jobUrl || 'https://paddleocr.aistudio-app.com/api/v2/ocr/jobs';
  const model = paddleOcrConfig.model || 'PaddleOCR-VL-1.5';
  const pollIntervalMs = paddleOcrConfig.pollIntervalMs || 5000;
  const timeoutMs = paddleOcrConfig.timeoutMs || 1000 * 60 * 20; // 20 minutes default timeout

  logger.info(`Submitting PaddleOCR job for file ${filename}...`);
  const { jobId } = await submitPaddleOcrJobByBuffer({
    buffer,
    filename,
    token,
    jobUrl,
    model
  });

  logger.info(`Polling PaddleOCR job ${jobId}...`);
  const { jsonUrl } = await pollPaddleOcrJobUntilDone({
    jobId,
    token,
    jobUrl,
    pollIntervalMs,
    timeoutMs
  });

  logger.info(`Downloading and parsing results from ${jsonUrl}...`);
  const result = await downloadJsonlAndBuildMarkdown({ jsonUrl });

  logger.info(`Successfully parsed file ${filename} with PaddleOCR.`);
  return result;
};
