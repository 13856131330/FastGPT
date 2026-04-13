import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ReadPermissionVal } from '@fastgpt/global/support/permission/constant';
import { MongoOrgModel } from '@fastgpt/service/support/permission/org/orgSchema';
import type { OrgListItemType } from '@fastgpt/global/support/user/team/org/type';
import { Types } from '@fastgpt/service/common/mongo';
import { TeamPermission } from '@fastgpt/global/support/permission/user/controller';
import { TeamDefaultRoleVal } from '@fastgpt/global/support/permission/user/constant';
import { getOrgChildrenPath } from '@fastgpt/global/support/user/team/org/constant';
import { createRootOrg } from '@fastgpt/service/support/permission/org/controllers';

type ReqBody = {
  orgId: string; // '' => root
  withPermission?: boolean;
  searchKey?: string;
};

async function handler(req: ApiRequestProps<ReqBody>, res: ApiResponseType<any>) {
  const { teamId } = await authUserPer({ req, authToken: true, per: ReadPermissionVal });
  const { orgId, withPermission = true, searchKey } = req.body;

  const teamObjectId = new Types.ObjectId(String(teamId));

  // root: list path === ''
  let childrenPath = '';
  if (orgId) {
    const parent = await MongoOrgModel.findOne({
      _id: new Types.ObjectId(String(orgId)),
      teamId: teamObjectId
    }).lean();
    if (parent) childrenPath = getOrgChildrenPath(parent as any);
  }

  // ensure root org exists
  if (!orgId) {
    const hasRoot = await MongoOrgModel.findOne({
      teamId: teamObjectId,
      path: '',
      name: 'ROOT'
    }).lean();
    if (!hasRoot) {
      await createRootOrg({ teamId: teamObjectId as any });
    }
  }

  const match: Record<string, any> = {
    teamId: teamObjectId,
    path: childrenPath
  };

  if (searchKey) {
    match.name = new RegExp(searchKey, 'i');
  }

  const orgs = await MongoOrgModel.find(match).sort({ updateTime: -1 }).lean();

  const permission = withPermission
    ? new TeamPermission({
        role: TeamDefaultRoleVal,
        isOwner: false
      })
    : undefined;

  const list: OrgListItemType[] = orgs.map((org) => ({
    ...(org as any),
    _id: String(org._id),
    teamId: String(teamId),
    total: 0,
    ...(permission ? { permission } : {})
  }));

  return list;
}

export default NextAPI(handler);
