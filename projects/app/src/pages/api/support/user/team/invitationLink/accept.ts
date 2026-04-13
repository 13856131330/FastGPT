import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ReadPermissionVal } from '@fastgpt/global/support/permission/constant';
import { acceptInvitationLink } from '@fastgpt/service/support/user/team/invitationLink/controller';

type ReqBody = {
  linkId: string;
};

async function handler(req: ApiRequestProps<ReqBody>, res: ApiResponseType<any>) {
  const { userId } = await authUserPer({ req, authToken: true, per: ReadPermissionVal });
  return acceptInvitationLink({ linkId: req.body.linkId, userId: String(userId) });
}

export default NextAPI(handler);
