import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authSystemAdmin } from '@fastgpt/service/support/permission/user/auth';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoGroupMemberModel } from '@fastgpt/service/support/permission/memberGroup/groupMemberSchema';
import { MongoOrgMemberModel } from '@fastgpt/service/support/permission/org/orgMemberSchema';
import { MongoResourcePermission } from '@fastgpt/service/support/permission/schema';
import { delUserAllSession } from '@fastgpt/service/support/user/session';
import { mongoSessionRun } from '@fastgpt/service/common/mongo/sessionRun';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { ERROR_ENUM } from '@fastgpt/global/common/error/errorCode';
import { Types } from '@fastgpt/service/common/mongo';

type ReqBody = {
  userId: string;
};

async function handler(req: ApiRequestProps<ReqBody>, res: ApiResponseType<any>) {
  await authSystemAdmin({ req });

  const { userId } = req.body || {};
  if (!userId) return Promise.reject(CommonErrEnum.missingParams);

  const user = await MongoUser.findById(userId).select('username').lean();
  if (!user) return Promise.reject(ERROR_ENUM.unAuthorization);
  if (user.username === 'root') return Promise.reject(ERROR_ENUM.unAuthorization);

  // 删除账号：MongoUser + 所有团队成员 + 组织/群组成员关系 + 资源权限（tmbId 维度） + 清理 session
  await mongoSessionRun(async (session) => {
    const tmbs = await MongoTeamMember.find({ userId: new Types.ObjectId(String(userId)) }, '_id', {
      session
    }).lean();
    const tmbIds = tmbs.map((t) => String(t._id));

    if (tmbIds.length > 0) {
      const objTmbIds = tmbIds.map((id) => new Types.ObjectId(id));
      await Promise.all([
        MongoGroupMemberModel.deleteMany({ tmbId: { $in: objTmbIds } }, { session }),
        MongoOrgMemberModel.deleteMany({ tmbId: { $in: objTmbIds } }, { session }),
        MongoResourcePermission.deleteMany({ tmbId: { $in: objTmbIds } }, { session })
      ]);
    }

    await MongoTeamMember.deleteMany({ userId: new Types.ObjectId(String(userId)) }, { session });
    await MongoUser.deleteOne({ _id: new Types.ObjectId(String(userId)) }, { session });
  });

  await delUserAllSession(String(userId));

  return 'OK';
}

export default NextAPI(handler);
