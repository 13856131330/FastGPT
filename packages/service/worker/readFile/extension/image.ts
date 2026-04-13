import { type ReadRawTextByBuffer, type ReadFileResponse } from '../type';

export const readImageFile = async (params: ReadRawTextByBuffer): Promise<ReadFileResponse> => {
  const { buffer, customPdfParse, extension } = params;
  const maxSize = 50 * 1024 * 1024; // 50MB fallback max size
  if (buffer.length > maxSize) {
    return Promise.reject(`File size exceeds limit of ${maxSize / 1024 / 1024}MB`);
  }

  const customPdfParseUrl = global.systemEnv?.customPdfParse?.url;

  if (customPdfParse && customPdfParseUrl) {
    const formData = new FormData();
    // Assuming customPdfParseUrl can also handle image files for OCR
    formData.append(
      'file',
      new Blob([buffer], { type: `image/${extension}` }),
      `image.${extension}`
    );
    try {
      const response = await fetch(customPdfParseUrl, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(180000) // 3 min
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = (await response.json()) as { markdown: string };

      if (result && result.markdown) {
        return {
          rawText: result.markdown
        };
      }
    } catch (e) {
      console.error('Image OCR API parse failed:', e);
      return Promise.reject('Failed to parse image using OCR API.');
    }
  }

  // If no external OCR URL configured, fallback or reject
  return Promise.reject(
    'No image OCR parse URL configured. Please configure customPdfParse.url in systemEnv.'
  );
};
