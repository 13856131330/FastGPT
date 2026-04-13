import { MongoUser } from '@fastgpt/service/support/user/schema';
import { getUserDetail } from '@fastgpt/service/support/user/controller';
import { UserStatusEnum } from '@fastgpt/global/support/user/constant';
import { NextAPI } from '@/service/middleware/entry';
import { useIPFrequencyLimit } from '@fastgpt/service/common/middle/reqFrequencyLimit';
import { pushTrack } from '@fastgpt/service/common/middle/tracks/utils';
import { UserErrEnum } from '@fastgpt/global/common/error/code/user';
import { addAuditLog } from '@fastgpt/service/support/user/audit/util';
import { AuditEventEnum } from '@fastgpt/global/support/user/audit/constants';
import { UserAuthTypeEnum } from '@fastgpt/global/support/user/auth/constants';
import { authCode } from '@fastgpt/service/support/user/auth/controller';
import { createUserSession } from '@fastgpt/service/support/user/session';
import requestIp from 'request-ip';
import { setCookie } from '@fastgpt/service/support/permission/auth/common';
import { UserError } from '@fastgpt/global/common/error/utils';
import { hashStr } from '@fastgpt/global/common/string/tools';
import {
  LoginByPasswordBodySchema,
  type LoginByPasswordBodyType,
  type LoginSuccessResponseType
} from '@fastgpt/global/openapi/support/user/account/login/api';
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';

async function handler(
  req: ApiRequestProps<LoginByPasswordBodyType>,
  res: ApiResponseType
): Promise<LoginSuccessResponseType> {
  const { username, password, code, language } = LoginByPasswordBodySchema.parse(req.body);

  // Auth prelogin code
  await authCode({
    key: username,
    code,
    type: UserAuthTypeEnum.login
  });

  // 只按 username 取用户，避免 mongoose 对 password 查询条件做 setter 导致 hash 不一致
  const user = await MongoUser.findOne({
    username
  })
    .select('+password username status lastLoginTmbId')
    .lean();

  if (!user) {
    return Promise.reject(UserErrEnum.account_psw_error);
  }
  if (user.status === UserStatusEnum.forbidden) {
    return Promise.reject('Invalid account!');
  }

  if (user.username.startsWith('wecom-')) {
    return Promise.reject(new UserError('Wecom user can not login with password'));
  }

  // 校验密码：兼容前端 sha256(明文) 传参，以及历史“双重 hash”存储
  const isSha256 = /^[a-f0-9]{64}$/i.test(password);
  const pw1 = isSha256 ? password : hashStr(password); // 单次 hash
  const pw2 = hashStr(pw1); // 双重 hash
  if ((user as any).password !== pw1 && (user as any).password !== pw2) {
    return Promise.reject(UserErrEnum.account_psw_error);
  }

  const userDetail = await getUserDetail({
    tmbId: (user as any)?.lastLoginTmbId,
    userId: (user as any)._id
  });

  await MongoUser.updateOne(
    { _id: (user as any)._id },
    { lastLoginTmbId: userDetail.team.tmbId, language }
  );

  const token = await createUserSession({
    userId: (user as any)._id,
    teamId: userDetail.team.teamId,
    tmbId: userDetail.team.tmbId,
    isRoot: username === 'root',
    ip: requestIp.getClientIp(req)
  });

  setCookie(res, token);

  pushTrack.login({
    type: 'password',
    uid: (user as any)._id,
    teamId: userDetail.team.teamId,
    tmbId: userDetail.team.tmbId
  });
  addAuditLog({
    tmbId: userDetail.team.tmbId,
    teamId: userDetail.team.teamId,
    event: AuditEventEnum.LOGIN
  });

  return {
    user: userDetail,
    token
  };
}

const lockTime = Number(process.env.PASSWORD_LOGIN_LOCK_SECONDS || 120);
export default NextAPI(
  useIPFrequencyLimit({ id: 'login-by-password', seconds: lockTime, limit: 10, force: true }),
  handler
);
