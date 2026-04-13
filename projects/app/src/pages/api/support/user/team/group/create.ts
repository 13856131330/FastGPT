import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ManagePermissionVal } from '@fastgpt/global/support/permission/constant';
import type { postCreateGroupData } from '@fastgpt/global/support/user/team/group/api';
import { MongoMemberGroupModel } from '@fastgpt/service/support/permission/memberGroup/memberGroupSchema';
import { MongoGroupMemberModel } from '@fastgpt/service/support/permission/memberGroup/groupMemberSchema';
import { GroupMemberRole } from '@fastgpt/global/support/permission/memberGroup/constant';
import { Types } from '@fastgpt/service/common/mongo';

async function handler(req: ApiRequestProps<postCreateGroupData>, res: ApiResponseType<any>) {
  const { teamId, tmbId } = await authUserPer({ req, authToken: true, per: ManagePermissionVal });
  const { name, avatar, memberIdList } = req.body;

  const teamObjectId = new Types.ObjectId(String(teamId));

  const group = await MongoMemberGroupModel.create({
    teamId: teamObjectId,
    name,
    avatar
  });

  const members = Array.from(new Set([String(tmbId), ...(memberIdList || [])]));
  await MongoGroupMemberModel.insertMany(
    members.map((id) => ({
      groupId: group._id,
      tmbId: new Types.ObjectId(String(id)),
      role: id === String(tmbId) ? GroupMemberRole.owner : GroupMemberRole.member
    }))
  );

  return String(group._id);
}

export default NextAPI(handler);
