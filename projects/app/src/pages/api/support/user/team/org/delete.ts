import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ManagePermissionVal } from '@fastgpt/global/support/permission/constant';
import { MongoOrgModel } from '@fastgpt/service/support/permission/org/orgSchema';
import { MongoOrgMemberModel } from '@fastgpt/service/support/permission/org/orgMemberSchema';
import { Types } from '@fastgpt/service/common/mongo';
import { getOrgChildrenPath } from '@fastgpt/global/support/user/team/org/constant';

type ReqQuery = {
  orgId: string;
};

async function handler(req: ApiRequestProps<{}, ReqQuery>, res: ApiResponseType<any>) {
  const { teamId } = await authUserPer({ req, authToken: true, per: ManagePermissionVal });
  const { orgId } = req.query;
  const teamObjectId = new Types.ObjectId(String(teamId));

  const org = await MongoOrgModel.findOne({
    _id: new Types.ObjectId(String(orgId)),
    teamId: teamObjectId
  }).lean();
  if (!org) return;

  const orgChildrenPath = getOrgChildrenPath(org as any);

  const orgs = await MongoOrgModel.find({
    teamId: teamObjectId,
    $or: [
      { _id: new Types.ObjectId(String(orgId)) },
      ...(orgChildrenPath ? [{ path: { $regex: new RegExp(`^${orgChildrenPath}`) } }] : [])
    ]
  }).lean();
  const orgIds = orgs.map((o) => o._id);

  await MongoOrgMemberModel.deleteMany({ teamId: teamObjectId, orgId: { $in: orgIds } });
  await MongoOrgModel.deleteMany({ teamId: teamObjectId, _id: { $in: orgIds } });
}

export default NextAPI(handler);
