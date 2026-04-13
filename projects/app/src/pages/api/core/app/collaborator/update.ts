import { NextAPI } from '@/service/middleware/entry';
import type { ApiRequestProps } from '@fastgpt/service/type/next';
import { authApp } from '@fastgpt/service/support/permission/app/auth';
import { ManagePermissionVal } from '@fastgpt/global/support/permission/constant';
import type { UpdateAppCollaboratorBody } from '@fastgpt/global/core/app/collaborator';
import { MongoResourcePermission } from '@fastgpt/service/support/permission/schema';
import { pickCollaboratorIdFields } from '@fastgpt/service/support/permission/utils';

async function handler(req: ApiRequestProps<UpdateAppCollaboratorBody>) {
  const { appId, collaborators } = req.body;

  const { teamId } = await authApp({
    req,
    authToken: true,
    appId,
    per: ManagePermissionVal
  });

  if (!Array.isArray(collaborators) || collaborators.length === 0) return;

  await MongoResourcePermission.bulkWrite(
    collaborators.map((clb) => ({
      updateOne: {
        filter: {
          teamId,
          resourceType: 'app',
          resourceId: appId,
          ...pickCollaboratorIdFields(clb as any)
        },
        update: {
          $set: {
            teamId,
            resourceType: 'app',
            resourceId: appId,
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
