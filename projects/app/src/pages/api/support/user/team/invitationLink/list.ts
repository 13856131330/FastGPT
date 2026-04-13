import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ReadPermissionVal } from '@fastgpt/global/support/permission/constant';
import { getInvitationLinkList } from '@fastgpt/service/support/user/team/invitationLink/controller';

async function handler(req: ApiRequestProps, res: ApiResponseType<any>) {
  const { teamId } = await authUserPer({ req, authToken: true, per: ReadPermissionVal });
  return getInvitationLinkList({ teamId: String(teamId) });
}

export default NextAPI(handler);
