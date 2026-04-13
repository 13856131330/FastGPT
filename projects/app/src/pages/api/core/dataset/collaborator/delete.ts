import { NextAPI } from '@/service/middleware/entry';
import type { ApiRequestProps } from '@fastgpt/service/type/next';
import { authDataset } from '@fastgpt/service/support/permission/dataset/auth';
import { ManagePermissionVal } from '@fastgpt/global/support/permission/constant';
import type { DatasetCollaboratorDeleteParams } from '@fastgpt/global/core/dataset/collaborator';
import { MongoResourcePermission } from '@fastgpt/service/support/permission/schema';
import { pickCollaboratorIdFields } from '@fastgpt/service/support/permission/utils';

async function handler(req: ApiRequestProps<{}, DatasetCollaboratorDeleteParams>) {
  const { datasetId, ...clb } = req.query;

  const { teamId } = await authDataset({
    req,
    authToken: true,
    authApiKey: true,
    datasetId,
    per: ManagePermissionVal
  });

  await MongoResourcePermission.deleteOne({
    teamId,
    resourceType: 'dataset',
    resourceId: datasetId,
    ...pickCollaboratorIdFields(clb as any)
  });
}

export default NextAPI(handler);
