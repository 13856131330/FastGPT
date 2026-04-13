import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ManagePermissionVal } from '@fastgpt/global/support/permission/constant';
import { MongoGroupMemberModel } from '@fastgpt/service/support/permission/memberGroup/groupMemberSchema';
import { GroupMemberRole } from '@fastgpt/global/support/permission/memberGroup/constant';
import { Types } from '@fastgpt/service/common/mongo';

type ReqBody = {
  groupId: string;
  tmbId: string;
};

async function handler(req: ApiRequestProps<ReqBody>, res: ApiResponseType<any>) {
  await authUserPer({ req, authToken: true, per: ManagePermissionVal });
  const { groupId, tmbId } = req.body;

  const groupObjectId = new Types.ObjectId(String(groupId));
  const tmbObjectId = new Types.ObjectId(String(tmbId));

  await MongoGroupMemberModel.updateMany(
    { groupId: groupObjectId, role: GroupMemberRole.owner },
    { $set: { role: GroupMemberRole.member } }
  );
  await MongoGroupMemberModel.updateOne(
    { groupId: groupObjectId, tmbId: tmbObjectId },
    { $set: { role: GroupMemberRole.owner } }
  );
}

export default NextAPI(handler);
