import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ManagePermissionVal } from '@fastgpt/global/support/permission/constant';
import { MongoResourcePermission } from '@fastgpt/service/support/permission/schema';
import type { CollaboratorIdType } from '@fastgpt/global/support/permission/collaborator';
import type { PermissionValueType } from '@fastgpt/global/support/permission/type';
import { pickCollaboratorIdFields } from '@fastgpt/service/support/permission/utils';

type ReqBody = CollaboratorIdType & { permission: PermissionValueType };

async function handler(req: ApiRequestProps<ReqBody>, res: ApiResponseType<any>) {
  const { teamId } = await authUserPer({ req, authToken: true, per: ManagePermissionVal });
  const { permission, ...clb } = req.body;

  await MongoResourcePermission.updateOne(
    {
      teamId: String(teamId),
      resourceType: 'team',
      ...pickCollaboratorIdFields(clb as any)
    },
    {
      $set: {
        teamId: String(teamId),
        resourceType: 'team',
        permission,
        ...pickCollaboratorIdFields(clb as any)
      }
    },
    { upsert: true }
  );
}

export default NextAPI(handler);
