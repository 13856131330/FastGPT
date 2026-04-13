import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ManagePermissionVal } from '@fastgpt/global/support/permission/constant';
import { forbidInvitationLink } from '@fastgpt/service/support/user/team/invitationLink/controller';

type ReqBody = {
  linkId: string;
};

async function handler(req: ApiRequestProps<ReqBody>, res: ApiResponseType<any>) {
  const { teamId } = await authUserPer({ req, authToken: true, per: ManagePermissionVal });
  await forbidInvitationLink({ teamId: String(teamId), linkId: req.body.linkId });
}

export default NextAPI(handler);
