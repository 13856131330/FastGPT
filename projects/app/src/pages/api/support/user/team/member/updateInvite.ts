import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ReadPermissionVal } from '@fastgpt/global/support/permission/constant';

// 开源版暂不实现邀请结果回写逻辑（商业版功能）。
// 为了兼容前端调用，返回空响应即可。
async function handler(req: ApiRequestProps, res: ApiResponseType<any>) {
  await authUserPer({ req, authToken: true, per: ReadPermissionVal });
}

export default NextAPI(handler);
