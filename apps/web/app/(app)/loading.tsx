import React from 'react';
import { Skeleton } from '../../components/ui';

export default function MemberRouteLoading() {
  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16 flex flex-col gap-6">
      <div className="flex flex-col gap-2 pb-5 border-b border-edge/60">
        <Skeleton rounded="tight" width="160px" height="14px" />
        <Skeleton rounded="tight" width="280px" height="30px" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 flex flex-col gap-4">
          <Skeleton rounded="panel" height="220px" />
          <Skeleton rounded="panel" height="180px" />
        </div>
        <div className="lg:col-span-4">
          <Skeleton rounded="panel" height="360px" />
        </div>
      </div>
    </div>
  );
}
