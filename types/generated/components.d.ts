import type { Schema, Attribute } from '@strapi/strapi';

export interface DaysDays extends Schema.Component {
  collectionName: 'components_days_days';
  info: {
    displayName: 'days';
    icon: 'layout';
    description: '';
  };
  attributes: {
    isWorkingDay: Attribute.Boolean & Attribute.DefaultTo<true>;
    start_at: Attribute.Time & Attribute.DefaultTo<'07:30'>;
    end_at: Attribute.Time & Attribute.DefaultTo<'03:30'>;
    day: Attribute.Relation<'days.days', 'oneToOne', 'api::day.day'>;
    isWeekEnd: Attribute.Boolean;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'days.days': DaysDays;
    }
  }
}
