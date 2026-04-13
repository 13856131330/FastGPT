import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ManagePermissionVal } from '@fastgpt/global/support/permission/constant';
import { MongoResourcePermission } from '@fastgpt/service/support/permission/schema';
import type { DeletePermissionQuery } from '@fastgpt/global/support/permission/collaborator';
import { pickCollaboratorIdFields } from '@fastgpt/service/support/permission/utils';

async function handler(req: ApiRequestProps<{}, DeletePermissionQuery>, res: ApiResponseType<any>) {
  const { teamId } = await authUserPer({ req, authToken: true, per: ManagePermissionVal });

  await MongoResourcePermission.deleteOne({
    teamId: String(teamId),
    resourceType: 'team',
    ...pickCollaboratorIdFields(req.query as any)
  });
}

export default NextAPI(handler);
