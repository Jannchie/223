import type { App } from 'vue'
import Alert from './Alert.vue'
import Avatar from './Avatar.vue'
import Badge from './Badge.vue'
import Button from './Button.vue'
import Card from './Card.vue'
import FormField from './FormField.vue'
import Icon from './Icon.vue'
import Input from './Input.vue'
import Kbd from './Kbd.vue'
import Modal from './Modal.vue'
import Select from './Select.vue'
import Switch from './Switch.vue'
import Tabs from './Tabs.vue'
import Textarea from './Textarea.vue'

// 自建轻量 UI 组件集合（替代 @nuxt/ui）。全局注册以便模板直接使用 <Button> 等。
export const components = {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  FormField,
  Icon,
  Input,
  Kbd,
  Modal,
  Select,
  Switch,
  Tabs,
  Textarea,
}

export default {
  install(app: App) {
    for (const [name, component] of Object.entries(components)) {
      app.component(name, component)
    }
  },
}

// 让模板中的全局组件获得类型提示
declare module 'vue' {
  export interface GlobalComponents {
    Alert: typeof Alert
    Avatar: typeof Avatar
    Badge: typeof Badge
    Button: typeof Button
    Card: typeof Card
    FormField: typeof FormField
    Icon: typeof Icon
    Input: typeof Input
    Kbd: typeof Kbd
    Modal: typeof Modal
    Select: typeof Select
    Switch: typeof Switch
    Tabs: typeof Tabs
    Textarea: typeof Textarea
  }
}
