import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ReadPermissionVal } from '@fastgpt/global/support/permission/constant';

type ReqBody = {
  teamId: string;
};

// 开源版默认单团队场景：提供兼容接口，避免前端报错。
async function handler(req: ApiRequestProps<ReqBody>, res: ApiResponseType<any>) {
  await authUserPer({ req, authToken: true, per: ReadPermissionVal });
  return req.body.teamId;
}

export default NextAPI(handler);
