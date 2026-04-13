import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ManagePermissionVal } from '@fastgpt/global/support/permission/constant';
import { MongoOrgMemberModel } from '@fastgpt/service/support/permission/org/orgMemberSchema';
import { Types } from '@fastgpt/service/common/mongo';

type ReqQuery = {
  orgId: string;
  tmbId: string;
};

async function handler(req: ApiRequestProps<{}, ReqQuery>, res: ApiResponseType<any>) {
  const { teamId } = await authUserPer({ req, authToken: true, per: ManagePermissionVal });
  const { orgId, tmbId } = req.query;

  await MongoOrgMemberModel.deleteOne({
    teamId: new Types.ObjectId(String(teamId)),
    orgId: new Types.ObjectId(String(orgId)),
    tmbId: new Types.ObjectId(String(tmbId))
  });
}

export default NextAPI(handler);
