import { getNanoid } from '@fastgpt/global/common/string/tools';
import type { InvitationInfoType, InvitationLinkCreateType, InvitationType } from './type';
import { MongoTeamInvitationLink } from './schema';
import { MaxInvitationLinksAmount } from './constants';
import { MongoTeamMember } from '../teamMemberSchema';
import { MongoTeam } from '../teamSchema';
import { MongoUser } from '../../schema';
import {
  TeamMemberRoleEnum,
  TeamMemberStatusEnum
} from '@fastgpt/global/support/user/team/constant';
import { Types } from '../../../../common/mongo';

const getExpiresDate = (expires: InvitationLinkCreateType['expires']) => {
  const now = Date.now();
  if (expires === '30m') return new Date(now + 30 * 60 * 1000);
  if (expires === '7d') return new Date(now + 7 * 24 * 60 * 60 * 1000);
  return new Date(now + 365 * 24 * 60 * 60 * 1000);
};

export async function createInvitationLink({
  teamId,
  data
}: {
  teamId: string;
  data: InvitationLinkCreateType;
}) {
  const count = await MongoTeamInvitationLink.countDocuments({ teamId });
  if (count >= MaxInvitationLinksAmount) {
    throw new Error('Invitation links amount reached limit');
  }

  const linkId = getNanoid(24);
  await MongoTeamInvitationLink.create({
    linkId,
    teamId,
    usedTimesLimit: data.usedTimesLimit,
    forbidden: false,
    expires: getExpiresDate(data.expires),
    description: data.description,
    members: []
  });
  return linkId;
}

export async function getInvitationLinkList({
  teamId
}: {
  teamId: string;
}): Promise<InvitationType[]> {
  const links = await MongoTeamInvitationLink.find({ teamId }).sort({ expires: -1 }).lean();
  const tmbIds = Array.from(new Set(links.flatMap((l) => l.members?.map((m) => String(m)) || [])));
  const tmbs = await MongoTeamMember.find({ _id: { $in: tmbIds } }, '_id name avatar').lean();
  const tmbMap = new Map(tmbs.map((t) => [String(t._id), t]));

  return links.map((l) => ({
    _id: String(l._id),
    linkId: l.linkId,
    teamId: String(l.teamId),
    usedTimesLimit: l.usedTimesLimit,
    forbidden: l.forbidden,
    expires: l.expires,
    description: l.description,
    members: (l.members || [])
      .map((id: any) => {
        const t = tmbMap.get(String(id));
        return t
          ? {
              tmbId: String(t._id),
              avatar: t.avatar,
              name: t.name
            }
          : undefined;
      })
      .filter(Boolean) as any
  }));
}

export async function getInvitationInfo({
  linkId
}: {
  linkId: string;
}): Promise<InvitationInfoType | null> {
  const link = await MongoTeamInvitationLink.findOne({ linkId }).lean();
  if (!link) return null;
  const team = await MongoTeam.findById(link.teamId, 'name avatar').lean();

  return {
    _id: String(link._id),
    linkId: link.linkId,
    teamId: String(link.teamId),
    usedTimesLimit: link.usedTimesLimit,
    forbidden: link.forbidden,
    expires: link.expires,
    description: link.description,
    members: (link.members || []).map(String),
    teamAvatar: team?.avatar,
    teamName: team?.name
  } as any;
}

export async function forbidInvitationLink({ teamId, linkId }: { teamId: string; linkId: string }) {
  await MongoTeamInvitationLink.updateOne({ teamId, linkId }, { $set: { forbidden: true } });
}

export async function acceptInvitationLink({ linkId, userId }: { linkId: string; userId: string }) {
  const link = await MongoTeamInvitationLink.findOne({ linkId }).lean();
  if (!link) {
    throw new Error('Invitation link not found');
  }
  if (link.forbidden) {
    throw new Error('Invitation link forbidden');
  }
  if (link.expires && new Date(link.expires).getTime() < Date.now()) {
    throw new Error('Invitation link expired');
  }
  const used = link.members?.length || 0;
  if (link.usedTimesLimit && link.usedTimesLimit !== -1 && used >= link.usedTimesLimit) {
    throw new Error('Invitation link reached usedTimesLimit');
  }

  const teamId = String(link.teamId);
  const teamObjectId = new Types.ObjectId(teamId);
  const userObjectId = new Types.ObjectId(String(userId));

  const user = await MongoUser.findById(userObjectId, 'username').lean();

  let tmb = await MongoTeamMember.findOne({ teamId: teamObjectId, userId: userObjectId }).lean();
  if (!tmb) {
    const created = await MongoTeamMember.create({
      teamId: teamObjectId,
      userId: userObjectId,
      name: user?.username || 'Member',
      role: 'member',
      status: TeamMemberStatusEnum.active
    });
    tmb = created.toObject();
  } else if (tmb.status !== TeamMemberStatusEnum.active) {
    await MongoTeamMember.updateOne(
      { _id: tmb._id },
      { $set: { status: TeamMemberStatusEnum.active } }
    );
  }

  await MongoTeamInvitationLink.updateOne({ _id: link._id }, { $addToSet: { members: tmb._id } });

  await MongoUser.updateOne({ _id: userObjectId }, { $set: { lastLoginTmbId: tmb._id } });

  return teamId;
}
