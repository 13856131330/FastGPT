import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ManagePermissionVal } from '@fastgpt/global/support/permission/constant';
import type { putUpdateGroupData } from '@fastgpt/global/support/user/team/group/api';
import { MongoMemberGroupModel } from '@fastgpt/service/support/permission/memberGroup/memberGroupSchema';
import { MongoGroupMemberModel } from '@fastgpt/service/support/permission/memberGroup/groupMemberSchema';
import { GroupMemberRole } from '@fastgpt/global/support/permission/memberGroup/constant';
import { Types } from '@fastgpt/service/common/mongo';

async function handler(req: ApiRequestProps<putUpdateGroupData>, res: ApiResponseType<any>) {
  const { teamId, tmbId } = await authUserPer({ req, authToken: true, per: ManagePermissionVal });
  const { groupId, name, avatar, memberList } = req.body;

  const groupObjectId = new Types.ObjectId(String(groupId));

  await MongoMemberGroupModel.updateOne(
    { _id: groupObjectId, teamId: new Types.ObjectId(String(teamId)) },
    {
      $set: {
        ...(name !== undefined ? { name } : {}),
        ...(avatar !== undefined ? { avatar } : {}),
        updateTime: new Date()
      }
    }
  );

  if (memberList) {
    const hasOwner = memberList.some((m) => m.role === GroupMemberRole.owner);
    const normalized = hasOwner
      ? memberList
      : [
          ...memberList.filter((m) => m.tmbId !== String(tmbId)),
          { tmbId: String(tmbId), role: GroupMemberRole.owner }
        ];

    await MongoGroupMemberModel.deleteMany({ groupId: groupObjectId });
    await MongoGroupMemberModel.insertMany(
      normalized.map((m) => ({
        groupId: groupObjectId,
        tmbId: new Types.ObjectId(String(m.tmbId)),
        role: m.role
      }))
    );
  }
}

export default NextAPI(handler);
