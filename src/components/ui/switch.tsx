import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  const [checked, setInternalChecked] = React.useState(props.checked ?? props.defaultChecked ?? false)

  React.useEffect(() => {
    if (props.checked !== undefined) setInternalChecked(props.checked)
  }, [props.checked])

  return (
    <SwitchPrimitive.Root
      className={className}
      style={{
        display: "inline-flex",
        height: 20,
        width: 36,
        flexShrink: 0,
        cursor: props.disabled ? "not-allowed" : "pointer",
        alignItems: "center",
        borderRadius: 9999,
        border: "2px solid transparent",
        transition: "background-color 0.15s",
        backgroundColor: checked ? "var(--primary)" : "var(--input)",
        opacity: props.disabled ? 0.5 : 1,
      }}
      {...props}
      onCheckedChange={(value) => {
        setInternalChecked(value)
        props.onCheckedChange?.(value)
      }}
    >
      <SwitchPrimitive.Thumb
        style={{
          pointerEvents: "none",
          display: "block",
          height: 16,
          width: 16,
          borderRadius: 9999,
          backgroundColor: "var(--background)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transition: "transform 0.15s",
          transform: checked ? "translateX(16px)" : "translateX(0px)",
        }}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
