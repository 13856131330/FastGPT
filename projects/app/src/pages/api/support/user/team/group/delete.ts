import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ManagePermissionVal } from '@fastgpt/global/support/permission/constant';
import { MongoMemberGroupModel } from '@fastgpt/service/support/permission/memberGroup/memberGroupSchema';
import { MongoGroupMemberModel } from '@fastgpt/service/support/permission/memberGroup/groupMemberSchema';
import { DefaultGroupName } from '@fastgpt/global/support/user/team/group/constant';
import { Types } from '@fastgpt/service/common/mongo';

type ReqQuery = {
  groupId: string;
};

async function handler(req: ApiRequestProps<{}, ReqQuery>, res: ApiResponseType<any>) {
  const { teamId } = await authUserPer({ req, authToken: true, per: ManagePermissionVal });
  const { groupId } = req.query;

  const group = await MongoMemberGroupModel.findOne({
    _id: new Types.ObjectId(String(groupId)),
    teamId: new Types.ObjectId(String(teamId))
  }).lean();
  if (!group) return;
  if (group.name === DefaultGroupName) return;

  await MongoGroupMemberModel.deleteMany({ groupId: group._id });
  await MongoMemberGroupModel.deleteOne({ _id: group._id });
}

export default NextAPI(handler);
