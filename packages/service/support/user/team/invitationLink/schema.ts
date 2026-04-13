import {
  TeamCollectionName,
  TeamMemberCollectionName
} from '@fastgpt/global/support/user/team/constant';
import { connectionMongo, getMongoModel } from '../../../../common/mongo';
import type { InvitationSchemaType } from './type';

const { Schema } = connectionMongo;

export const TeamInvitationLinkCollectionName = 'team_invitation_links';

export const TeamInvitationLinkSchema = new Schema(
  {
    linkId: {
      type: String,
      required: true,
      unique: true
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: TeamCollectionName,
      required: true
    },
    usedTimesLimit: Number, // -1 means unlimited
    forbidden: Boolean,
    expires: {
      type: Date,
      required: true
    },
    description: {
      type: String,
      default: ''
    },
    members: {
      type: [Schema.Types.ObjectId],
      ref: TeamMemberCollectionName,
      default: []
    }
  },
  {
    timestamps: true
  }
);

try {
  TeamInvitationLinkSchema.index({ teamId: 1, expires: -1 });
  // Auto cleanup expired links
  TeamInvitationLinkSchema.index({ expires: 1 }, { expireAfterSeconds: 0 });
} catch {}

export const MongoTeamInvitationLink = getMongoModel<InvitationSchemaType>(
  TeamInvitationLinkCollectionName,
  TeamInvitationLinkSchema
);
