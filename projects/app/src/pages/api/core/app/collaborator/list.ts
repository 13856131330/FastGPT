import { NextAPI } from '@/service/middleware/entry';
import type { ApiRequestProps } from '@fastgpt/service/type/next';
import { authApp } from '@fastgpt/service/support/permission/app/auth';
import { ReadPermissionVal } from '@fastgpt/global/support/permission/constant';
import type { CollaboratorListType } from '@fastgpt/global/support/permission/collaborator';
import { getClbsInfo, getResourceOwnedClbs } from '@fastgpt/service/support/permission/controller';

type Query = {
  appId: string;
};

async function handler(req: ApiRequestProps<Query>): Promise<CollaboratorListType> {
  const { appId } = req.query;

  const { app, teamId, tmbId } = await authApp({
    req,
    authToken: true,
    appId,
    per: ReadPermissionVal
  });

  const clbs = await getResourceOwnedClbs({
    resourceType: 'app',
    teamId,
    resourceId: appId
  });

  const detail = await getClbsInfo({
    teamId,
    ownerTmbId: String((app as any).tmbId || tmbId),
    clbs: clbs.map((c) => ({
      ...(c.tmbId ? { tmbId: String(c.tmbId) } : {}),
      ...(c.orgId ? { orgId: String(c.orgId) } : {}),
      ...(c.groupId ? { groupId: String(c.groupId) } : {}),
      permission: c.permission
    })) as any
  });

  return { clbs: detail };
}

export default NextAPI(handler);
