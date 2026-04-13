import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { getInvitationInfo } from '@fastgpt/service/support/user/team/invitationLink/controller';

type ReqQuery = {
  linkId: string;
};

// 允许未登录用户获取邀请信息（用于展示团队名称/头像）
async function handler(req: ApiRequestProps<{}, ReqQuery>, res: ApiResponseType<any>) {
  return getInvitationInfo({ linkId: req.query.linkId });
}

export default NextAPI(handler);
