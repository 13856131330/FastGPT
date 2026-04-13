import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ManagePermissionVal } from '@fastgpt/global/support/permission/constant';
import { MongoOrgModel } from '@fastgpt/service/support/permission/org/orgSchema';
import type { putUpdateOrgData } from '@fastgpt/global/support/user/team/org/api';
import { Types } from '@fastgpt/service/common/mongo';

async function handler(req: ApiRequestProps<putUpdateOrgData>, res: ApiResponseType<any>) {
  const { teamId } = await authUserPer({ req, authToken: true, per: ManagePermissionVal });
  const { orgId, name, avatar, description } = req.body;

  await MongoOrgModel.updateOne(
    { _id: new Types.ObjectId(String(orgId)), teamId: new Types.ObjectId(String(teamId)) },
    {
      $set: {
        ...(name !== undefined ? { name } : {}),
        ...(avatar !== undefined ? { avatar } : {}),
        ...(description !== undefined ? { description } : {}),
        updateTime: new Date()
      }
    }
  );
}

export default NextAPI(handler);
