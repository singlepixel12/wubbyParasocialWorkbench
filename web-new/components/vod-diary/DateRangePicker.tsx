'use client';

/**
 * DateRangePicker Component
 * Date range selection with presets (including "This Week")
 * Based on John Polacik's DateRangePicker approach with shadcn Calendar
 * Replaces: Flatpickr from vod-diary.html
 */

import * as React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { formatDateDisplay, getThisWeekRange } from '@/lib/utils/video-helpers';
import { lastNDays, lastNMonths } from '@/lib/utils/date-range';

interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
}

export function DateRangePicker({
  value,
  onChange,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Preset date ranges — whole local days, the same shape a hand-picked range has
  const presets = [
    { label: 'This Week', getRange: () => getThisWeekRange() },
    { label: 'Last 2 Weeks', getRange: () => lastNDays(14) },
    { label: 'Last Month', getRange: () => lastNMonths(1) },
    { label: 'Last 3 Months', getRange: () => lastNMonths(3) },
  ];

  const handlePresetClick = (preset: typeof presets[0]) => {
    const range = preset.getRange();
    onChange(range);
  };

  const displayText = React.useMemo(() => {
    if (value?.from) {
      if (value.to) {
        return `${formatDateDisplay(value.from)} - ${formatDateDisplay(value.to)}`;
      }
      return formatDateDisplay(value.from);
    }
    return 'Pick a date range';
  }, [value]);

  return (
    <div className={cn('grid gap-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal',
              !value && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {displayText}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            {/* Presets sidebar */}
            <div className="flex flex-col gap-1 border-r p-3">
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Presets
              </div>
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="justify-start text-sm"
                  onClick={() => {
                    handlePresetClick(preset);
                    setOpen(false);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            {/* Calendar */}
            <div className="p-3">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={value?.from}
                selected={value}
                onSelect={(range) => {
                  onChange(range);
                  // Auto-close when both dates are selected
                  if (range?.from && range?.to) {
                    setOpen(false);
                  }
                }}
                numberOfMonths={2}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
