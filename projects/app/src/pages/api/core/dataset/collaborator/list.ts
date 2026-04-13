import { NextAPI } from '@/service/middleware/entry';
import type { ApiRequestProps } from '@fastgpt/service/type/next';
import { authDataset } from '@fastgpt/service/support/permission/dataset/auth';
import { ReadPermissionVal } from '@fastgpt/global/support/permission/constant';
import type { CollaboratorListType } from '@fastgpt/global/support/permission/collaborator';
import { getClbsInfo, getResourceOwnedClbs } from '@fastgpt/service/support/permission/controller';

type Query = {
  datasetId: string;
};

async function handler(req: ApiRequestProps<Query>): Promise<CollaboratorListType> {
  const { datasetId } = req.query;

  const { dataset, teamId, tmbId } = await authDataset({
    req,
    authToken: true,
    authApiKey: true,
    datasetId,
    per: ReadPermissionVal
  });

  const clbs = await getResourceOwnedClbs({
    resourceType: 'dataset',
    teamId,
    resourceId: datasetId
  });

  const detail = await getClbsInfo({
    teamId,
    ownerTmbId: String((dataset as any).tmbId || tmbId),
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
