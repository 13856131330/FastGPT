import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ManagePermissionVal } from '@fastgpt/global/support/permission/constant';
import { MongoOrgMemberModel } from '@fastgpt/service/support/permission/org/orgMemberSchema';
import type { putUpdateOrgMembersData } from '@fastgpt/global/support/user/team/org/api';
import { Types } from '@fastgpt/service/common/mongo';

async function handler(req: ApiRequestProps<putUpdateOrgMembersData>, res: ApiResponseType<any>) {
  const { teamId } = await authUserPer({ req, authToken: true, per: ManagePermissionVal });
  const { orgId, members } = req.body;
  if (!orgId) return;

  const teamObjectId = new Types.ObjectId(String(teamId));
  const orgObjectId = new Types.ObjectId(String(orgId));

  await MongoOrgMemberModel.deleteMany({ teamId: teamObjectId, orgId: orgObjectId });

  if (members?.length) {
    await MongoOrgMemberModel.insertMany(
      members.map((m) => ({
        teamId: teamObjectId,
        orgId: orgObjectId,
        tmbId: new Types.ObjectId(String(m.tmbId))
      }))
    );
  }
}

export default NextAPI(handler);
