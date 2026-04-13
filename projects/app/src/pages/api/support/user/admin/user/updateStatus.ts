import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authSystemAdmin } from '@fastgpt/service/support/permission/user/auth';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { delUserAllSession } from '@fastgpt/service/support/user/session';
import { UserStatusEnum } from '@fastgpt/global/support/user/constant';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { ERROR_ENUM } from '@fastgpt/global/common/error/errorCode';

type ReqBody = {
  userId: string;
  status: `${UserStatusEnum}`;
};

async function handler(req: ApiRequestProps<ReqBody>, res: ApiResponseType<any>) {
  await authSystemAdmin({ req });

  const { userId, status } = req.body || {};
  if (!userId || !status) return Promise.reject(CommonErrEnum.missingParams);

  const user = await MongoUser.findById(userId).select('username').lean();
  if (!user) return Promise.reject(ERROR_ENUM.unAuthorization);
  if (user.username === 'root') return Promise.reject(ERROR_ENUM.unAuthorization);

  await MongoUser.updateOne({ _id: userId }, { $set: { status } });

  // 停用账号时，清理所有 session 让其立即下线
  if (status === UserStatusEnum.forbidden) {
    await delUserAllSession(String(userId));
  }

  return 'OK';
}

export default NextAPI(handler);
