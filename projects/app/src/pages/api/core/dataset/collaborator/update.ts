import { NextAPI } from '@/service/middleware/entry';
import type { ApiRequestProps } from '@fastgpt/service/type/next';
import { authDataset } from '@fastgpt/service/support/permission/dataset/auth';
import { ManagePermissionVal } from '@fastgpt/global/support/permission/constant';
import type { UpdateDatasetCollaboratorBody } from '@fastgpt/global/core/dataset/collaborator';
import { MongoResourcePermission } from '@fastgpt/service/support/permission/schema';
import { pickCollaboratorIdFields } from '@fastgpt/service/support/permission/utils';

async function handler(req: ApiRequestProps<UpdateDatasetCollaboratorBody>) {
  const { datasetId, collaborators } = req.body;

  const { teamId } = await authDataset({
    req,
    authToken: true,
    authApiKey: true,
    datasetId,
    per: ManagePermissionVal
  });

  if (!Array.isArray(collaborators) || collaborators.length === 0) return;

  await MongoResourcePermission.bulkWrite(
    collaborators.map((clb) => ({
      updateOne: {
        filter: {
          teamId,
          resourceType: 'dataset',
          resourceId: datasetId,
          ...pickCollaboratorIdFields(clb as any)
        },
        update: {
          $set: {
            teamId,
            resourceType: 'dataset',
            resourceId: datasetId,
            permission: clb.permission,
            ...pickCollaboratorIdFields(clb as any)
          }
        },
        upsert: true
      }
    }))
  );
}

export default NextAPI(handler);
