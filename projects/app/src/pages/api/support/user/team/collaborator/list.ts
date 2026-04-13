import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ReadPermissionVal } from '@fastgpt/global/support/permission/constant';
import type { CollaboratorListType } from '@fastgpt/global/support/permission/collaborator';
import { getClbsInfo, getResourceOwnedClbs } from '@fastgpt/service/support/permission/controller';

async function handler(req: ApiRequestProps, res: ApiResponseType<any>) {
  const { teamId, tmbId } = await authUserPer({ req, authToken: true, per: ReadPermissionVal });

  const clbs = await getResourceOwnedClbs({
    resourceType: 'team',
    teamId: String(teamId)
  });

  const detail = await getClbsInfo({
    teamId: String(teamId),
    ownerTmbId: String(tmbId),
    clbs: clbs.map((c) => ({
      ...(c.tmbId ? { tmbId: String(c.tmbId) } : {}),
      ...(c.orgId ? { orgId: String(c.orgId) } : {}),
      ...(c.groupId ? { groupId: String(c.groupId) } : {}),
      permission: c.permission
    })) as any
  });

  const data: CollaboratorListType = { clbs: detail };
  return data;
}

export default NextAPI(handler);
