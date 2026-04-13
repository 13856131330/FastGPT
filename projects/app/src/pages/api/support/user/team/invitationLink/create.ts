import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ManagePermissionVal } from '@fastgpt/global/support/permission/constant';
import type { InvitationLinkCreateType } from '@fastgpt/service/support/user/team/invitationLink/type';
import { createInvitationLink } from '@fastgpt/service/support/user/team/invitationLink/controller';

async function handler(req: ApiRequestProps<InvitationLinkCreateType>, res: ApiResponseType<any>) {
  const { teamId } = await authUserPer({ req, authToken: true, per: ManagePermissionVal });
  return createInvitationLink({ teamId: String(teamId), data: req.body });
}

export default NextAPI(handler);
