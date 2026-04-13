import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ManagePermissionVal } from '@fastgpt/global/support/permission/constant';
import { MongoOrgModel } from '@fastgpt/service/support/permission/org/orgSchema';
import type { postCreateOrgData } from '@fastgpt/global/support/user/team/org/api';
import { Types } from '@fastgpt/service/common/mongo';
import { getOrgChildrenPath } from '@fastgpt/global/support/user/team/org/constant';
import { DEFAULT_ORG_AVATAR } from '@fastgpt/global/common/system/constants';

async function handler(req: ApiRequestProps<postCreateOrgData>, res: ApiResponseType<any>) {
  const { teamId } = await authUserPer({ req, authToken: true, per: ManagePermissionVal });
  const { name, description, avatar, orgId } = req.body;

  const teamObjectId = new Types.ObjectId(String(teamId));

  let path = '';
  if (orgId) {
    const parent = await MongoOrgModel.findOne({
      _id: new Types.ObjectId(String(orgId)),
      teamId: teamObjectId
    }).lean();
    if (parent) path = getOrgChildrenPath(parent as any);
  }

  const org = await MongoOrgModel.create({
    teamId: teamObjectId,
    path,
    name,
    description,
    avatar: avatar || DEFAULT_ORG_AVATAR,
    updateTime: new Date()
  });

  return String(org._id);
}

export default NextAPI(handler);
