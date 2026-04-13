import { NextAPI } from '@/service/middleware/entry';
import type { ApiRequestProps } from '@fastgpt/service/type/next';
import { authApp } from '@fastgpt/service/support/permission/app/auth';
import { ManagePermissionVal } from '@fastgpt/global/support/permission/constant';
import type { AppCollaboratorDeleteParams } from '@fastgpt/global/core/app/collaborator';
import { MongoResourcePermission } from '@fastgpt/service/support/permission/schema';
import { pickCollaboratorIdFields } from '@fastgpt/service/support/permission/utils';

async function handler(req: ApiRequestProps<{}, AppCollaboratorDeleteParams>) {
  const { appId, ...clb } = req.query;

  const { teamId } = await authApp({
    req,
    authToken: true,
    appId,
    per: ManagePermissionVal
  });

  await MongoResourcePermission.deleteOne({
    teamId,
    resourceType: 'app',
    resourceId: appId,
    ...pickCollaboratorIdFields(clb as any)
  });
}

export default NextAPI(handler);
