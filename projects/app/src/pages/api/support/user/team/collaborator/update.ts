import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ManagePermissionVal } from '@fastgpt/global/support/permission/constant';
import type { UpdateClbPermissionProps } from '@fastgpt/global/support/permission/collaborator';
import { MongoResourcePermission } from '@fastgpt/service/support/permission/schema';
import { pickCollaboratorIdFields } from '@fastgpt/service/support/permission/utils';

async function handler(req: ApiRequestProps<UpdateClbPermissionProps>, res: ApiResponseType<any>) {
  const { teamId } = await authUserPer({ req, authToken: true, per: ManagePermissionVal });
  const { collaborators } = req.body;

  if (!Array.isArray(collaborators) || collaborators.length === 0) return;

  await MongoResourcePermission.bulkWrite(
    collaborators.map((clb) => ({
      updateOne: {
        filter: {
          teamId: String(teamId),
          resourceType: 'team',
          ...pickCollaboratorIdFields(clb as any)
        },
        update: {
          $set: {
            teamId: String(teamId),
            resourceType: 'team',
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
