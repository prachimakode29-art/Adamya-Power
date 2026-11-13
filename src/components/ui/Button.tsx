import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  children: React.ReactNode;
  className?: string;
  asChild?: boolean;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

export function Button({ variant = 'primary', children, className = '', asChild = false, ...props }: ButtonProps) {
  const baseStyle = "px-6 py-3 rounded-lg font-medium transition-all duration-300 flex items-center justify-center";
  
  // Primary has the subtle gradient requested
  const variants = {
    primary: "bg-gradient-to-r from-[#003399] to-[#0055cc] text-white hover:opacity-90 hover:shadow-lg hover:shadow-blue-500/20 shadow-md",
    secondary: "bg-white text-[#003399] border border-gray-200 shadow-sm hover:border-[#22c55e] hover:text-[#22c55e]",
    outline: "border-2 border-[#003399] text-[#003399] hover:bg-slate-50"
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      className: `${baseStyle} ${variants[variant]} ${className} ${children.props.className || ''}`,
      ...props
    });
  }

  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
