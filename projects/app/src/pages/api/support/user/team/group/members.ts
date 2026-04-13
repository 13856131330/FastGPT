import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ReadPermissionVal } from '@fastgpt/global/support/permission/constant';
import { MongoGroupMemberModel } from '@fastgpt/service/support/permission/memberGroup/groupMemberSchema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import type { GroupMemberItemType } from '@fastgpt/global/support/permission/memberGroup/type';
import { Types } from '@fastgpt/service/common/mongo';

type ReqQuery = {
  groupId: string;
};

async function handler(req: ApiRequestProps<{}, ReqQuery>, res: ApiResponseType<any>) {
  const { teamId } = await authUserPer({ req, authToken: true, per: ReadPermissionVal });
  const { groupId } = req.query;

  const groupObjectId = new Types.ObjectId(String(groupId));
  const members = await MongoGroupMemberModel.find({ groupId: groupObjectId }).lean();
  const tmbIds = members.map((m) => m.tmbId);

  const tmbs = await MongoTeamMember.find({
    teamId: new Types.ObjectId(String(teamId)),
    _id: { $in: tmbIds }
  }).lean();
  const tmbMap = new Map(tmbs.map((t) => [String(t._id), t]));

  const list: GroupMemberItemType[] = members
    .map((m) => {
      const tmb = tmbMap.get(String(m.tmbId));
      if (!tmb) return;
      return {
        tmbId: String(tmb._id),
        name: tmb.name,
        avatar: tmb.avatar,
        role: m.role
      };
    })
    .filter(Boolean) as GroupMemberItemType[];

  return list;
}

export default NextAPI(handler);
