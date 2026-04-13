import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ReadPermissionVal } from '@fastgpt/global/support/permission/constant';
import { MongoOrgModel } from '@fastgpt/service/support/permission/org/orgSchema';
import { MongoOrgMemberModel } from '@fastgpt/service/support/permission/org/orgMemberSchema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import type { PaginationProps, PaginationResponseType } from '@fastgpt/global/openapi/api';
import type { TeamMemberItemType } from '@fastgpt/global/support/user/team/type';
import { TeamPermission } from '@fastgpt/global/support/permission/user/controller';
import { TeamDefaultRoleVal } from '@fastgpt/global/support/permission/user/constant';
import { getTmbPermission } from '@fastgpt/service/support/permission/controller';
import { TeamMemberRoleEnum } from '@fastgpt/global/support/user/team/constant';
import { Types } from '@fastgpt/service/common/mongo';

type ReqQuery = PaginationProps<{
  orgPath?: string;
}>;

async function handler(req: ApiRequestProps<{}, ReqQuery>, res: ApiResponseType<any>) {
  const { teamId } = await authUserPer({ req, authToken: true, per: ReadPermissionVal });
  const { pageSize, pageNum, offset, orgPath } = req.query;

  const limit = Math.min(Number(pageSize || 20), 100);
  const skip =
    offset !== undefined ? Number(offset) : Math.max(Number(pageNum || 1) - 1, 0) * limit;

  const teamObjectId = new Types.ObjectId(String(teamId));

  let orgId: Types.ObjectId | undefined;
  if (orgPath) {
    const last = orgPath.split('/').filter(Boolean).pop();
    if (last) {
      const org = await MongoOrgModel.findOne({ teamId: teamObjectId, pathId: last }).lean();
      if (org) orgId = org._id as any;
    }
  }

  if (!orgId) {
    return { total: 0, list: [] } as PaginationResponseType<TeamMemberItemType>;
  }

  const orgMembers = await MongoOrgMemberModel.find(
    { teamId: teamObjectId, orgId },
    'tmbId'
  ).lean();
  const tmbIds = orgMembers.map((m) => m.tmbId);

  const total = tmbIds.length;
  const pageTmbIds = tmbIds.slice(skip, skip + limit);

  const tmbs = await MongoTeamMember.find({ _id: { $in: pageTmbIds } }).lean();

  const list: TeamMemberItemType[] = await Promise.all(
    tmbs.map(async (item) => {
      const tmbId = String(item._id);
      const role = (item.role as any) || 'member';
      const permissionRole =
        (await getTmbPermission({ resourceType: 'team', teamId: String(teamId), tmbId })) ??
        TeamDefaultRoleVal;

      return {
        userId: String(item.userId),
        tmbId,
        teamId: String(teamId),
        memberName: item.name,
        avatar: item.avatar,
        role,
        status: item.status,
        createTime: item.createTime,
        updateTime: item.updateTime,
        permission: new TeamPermission({
          role: permissionRole,
          isOwner: role === TeamMemberRoleEnum.owner
        }),
        orgs: []
      } as any;
    })
  );

  return { total, list } as PaginationResponseType<TeamMemberItemType>;
}

export default NextAPI(handler);
