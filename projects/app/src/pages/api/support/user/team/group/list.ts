import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ReadPermissionVal } from '@fastgpt/global/support/permission/constant';
import type { GetGroupListBody } from '@fastgpt/global/support/permission/memberGroup/api';
import type { MemberGroupListItemType } from '@fastgpt/global/support/permission/memberGroup/type';
import { MongoMemberGroupModel } from '@fastgpt/service/support/permission/memberGroup/memberGroupSchema';
import { MongoGroupMemberModel } from '@fastgpt/service/support/permission/memberGroup/groupMemberSchema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { Types } from '@fastgpt/service/common/mongo';
import { Permission } from '@fastgpt/global/support/permission/controller';

async function handler(req: ApiRequestProps<GetGroupListBody>, res: ApiResponseType<any>) {
  const { teamId } = await authUserPer({ req, authToken: true, per: ReadPermissionVal });
  const { searchKey, withMembers } = req.body;

  const teamObjectId = new Types.ObjectId(String(teamId));

  const groups = await MongoMemberGroupModel.find({
    teamId: teamObjectId,
    ...(searchKey ? { name: new RegExp(searchKey, 'i') } : {})
  })
    .sort({ updateTime: -1 })
    .lean();

  if (!withMembers) {
    return groups.map((g) => ({
      ...(g as any),
      _id: String(g._id),
      teamId: String(teamId)
    })) as MemberGroupListItemType<false>[];
  }

  const groupIds = groups.map((g) => g._id);
  const groupMembers = await MongoGroupMemberModel.find({ groupId: { $in: groupIds } }).lean();

  const tmbIds = Array.from(new Set(groupMembers.map((m) => String(m.tmbId))));
  const tmbMap = new Map(
    (
      await MongoTeamMember.find({
        _id: { $in: tmbIds.map((id) => new Types.ObjectId(id)) }
      }).lean()
    ).map((tmb) => [String(tmb._id), tmb])
  );

  return groups.map((g) => {
    const groupMemberRows = groupMembers.filter((m) => String(m.groupId) === String(g._id));
    const members = groupMemberRows
      .map((m) => {
        const tmb = tmbMap.get(String(m.tmbId));
        return tmb
          ? {
              tmbId: String(tmb._id),
              name: tmb.name,
              avatar: tmb.avatar
            }
          : undefined;
      })
      .filter(Boolean) as any[];

    const ownerRow = groupMemberRows.find((m) => m.role === 'owner');
    const owner = ownerRow ? members.find((m) => m.tmbId === String(ownerRow.tmbId)) : undefined;

    return {
      ...(g as any),
      _id: String(g._id),
      teamId: String(teamId),
      members,
      count: members.length,
      owner,
      permission: new Permission()
    } as MemberGroupListItemType<true>;
  });
}

export default NextAPI(handler);
