import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// A password field with a built-in show/hide toggle. Forwards every Input prop;
// the eye button only swaps the input's type between 'password' and 'text', so
// the value lives nowhere but the field itself. The toggle is kept out of the tab
// order (tabIndex={-1}) so keyboard users flow straight through the form, and the
// caller's `type` is ignored — this is always a password field.
const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type: _type, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn('pr-10', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          title={visible ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-muted transition-colors hover:text-ink focus-visible:text-primary focus-visible:outline-none"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
