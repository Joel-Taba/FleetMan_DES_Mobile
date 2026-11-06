import { Eye, EyeOff, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable, Text, TextInput, View, type KeyboardTypeOptions, type TextStyle } from "react-native";

import { useT } from "@/i18n";
import { colors, fonts, radius, themedStyles } from "@/theme/tokens";

type Props = {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  error?: string | null;
  icon?: LucideIcon;
  editable?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
};

/** Dark glass input with label, leading icon, error text and a show/hide toggle for passwords. */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType,
  secureTextEntry = false,
  error,
  icon: Icon,
  editable = true,
  autoCapitalize,
}: Props) {
  const { t } = useT();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const borderColor = error ? colors.danger : focused ? colors.accentSoft : colors.glassBorder;

  return (
    <View style={styles.root}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.box,
          { borderColor, opacity: editable ? 1 : 0.6 },
          multiline && styles.multilineBox,
        ]}
      >
        {Icon ? (
          <View style={[styles.iconBox, multiline && styles.iconTop]}>
            <Icon size={18} color={focused ? colors.accentSoft : colors.textMuted} strokeWidth={2} />
          </View>
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          multiline={multiline}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry && hidden}
          editable={editable}
          autoCapitalize={autoCapitalize ?? (secureTextEntry ? "none" : undefined)}
          autoCorrect={!secureTextEntry}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          selectionColor={colors.accent}
          textAlignVertical={multiline ? "top" : "center"}
          accessibilityLabel={label ?? placeholder}
          style={[styles.input, multiline && styles.multilineInput, Platform.OS === "web" && webNoOutline]}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? t("Afficher le mot de passe") : t("Masquer le mot de passe")}
            style={styles.iconBox}
          >
            {hidden ? (
              <Eye size={18} color={colors.textMuted} strokeWidth={2} />
            ) : (
              <EyeOff size={18} color={colors.textMuted} strokeWidth={2} />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

// The focus state is shown by the field border; hide the browser outline on web.
const webNoOutline = { outlineStyle: "none" } as unknown as TextStyle;

const styles = themedStyles(() => ({
  root: { gap: 6 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textSecondary, marginLeft: 4 },
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.inputBg,
  },
  multilineBox: { alignItems: "flex-start", paddingVertical: 12, minHeight: 110 },
  iconTop: { marginTop: 2 },
  iconBox: { flexShrink: 0 },
  input: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    paddingVertical: 12,
  },
  multilineInput: { minHeight: 86, paddingVertical: 0 },
  error: { fontFamily: fonts.body, fontSize: 12.5, color: colors.danger, marginLeft: 4 },
}));
