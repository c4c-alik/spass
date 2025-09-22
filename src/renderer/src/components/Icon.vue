<template>
  <div class="icon-wrapper" @mouseenter="showTooltip" @mouseleave="hideTooltip">
    <svg
      v-if="svgContent"
      class="icon"
      :class="className"
      :width="width"
      :height="height"
      :style="style"
      v-html="innerContent"
    ></svg>
    <div 
      v-if="title && tooltipVisible" 
      class="tooltip show"
      :style="{ top: tooltipPosition.top + 'px', left: tooltipPosition.left + 'px' }"
    >
      {{ title }}
      <div class="tooltip-arrow"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps({
  name: {
    type: String,
    required: true
  },
  width: {
    type: [String, Number],
    default: 16
  },
  height: {
    type: [String, Number],
    default: 16
  },
  className: {
    type: String,
    default: ''
  },
  style: {
    type: Object,
    default: () => ({})
  },
  title: {
    type: String,
    default: ''
  }
})

const svgContent = ref('')
const innerContent = ref('')

// 图标映射表
const iconMap: Record<string, string> = {
  check: '/src/assets/icons/check.svg',
  clock: '/src/assets/icons/clock.svg',
  cog: '/src/assets/icons/cog.svg',
  copy: '/src/assets/icons/copy.svg',
  'credit-card': '/src/assets/icons/credit-card.svg',
  dice: '/src/assets/icons/dice.svg',
  edit: '/src/assets/icons/edit.svg',
  'eye-off': '/src/assets/icons/eye-off.svg',
  eye: '/src/assets/icons/eye.svg',
  globe: '/src/assets/icons/globe.svg',
  key: '/src/assets/icons/key.svg',
  lock: '/src/assets/icons/lock.svg',
  link: '/src/assets/icons/link.svg',
  menu: '/src/assets/icons/menu.svg',
  mobile: '/src/assets/icons/mobile.svg',
  network: '/src/assets/icons/network.svg',
  'plus-circle': '/src/assets/icons/plus-circle.svg',
  plus: '/src/assets/icons/plus.svg',
  search: '/src/assets/icons/search.svg',
  shield: '/src/assets/icons/shield.svg',
  'star-filled': '/src/assets/icons/star-filled.svg',
  star: '/src/assets/icons/star.svg',
  sync: '/src/assets/icons/sync.svg',
  trash: '/src/assets/icons/trash.svg',
  x: '/src/assets/icons/x.svg'
}

const loadIcon = async (): Promise<void> => {
  try {
    const iconName = props.name
    if (!iconMap[iconName]) {
      console.warn(`Icon "${iconName}" not found in icon map`)
      return
    }

    const response = await fetch(iconMap[iconName])
    const svgText = await response.text()

    // 提取SVG内容（去除svg标签本身）
    const match = svgText.match(/<svg[^>]*>([\s\S]*)<\/svg>/)
    if (match && match[1]) {
      // 移除原始SVG中的width和height属性，让CSS控制大小
      let cleanedSvgContent = svgText.replace(/width="[^"]*"/, '').replace(/height="[^"]*"/, '')
      svgContent.value = cleanedSvgContent
      innerContent.value = match[1]
    }
  } catch (error) {
    console.error(`Failed to load icon: ${props.name}`, error)
  }
}

watch(() => props.name, loadIcon, { immediate: true })

// Tooltip相关逻辑
const tooltipVisible = ref(false)
const tooltipPosition = ref({ top: 0, left: 0 })

function showTooltip(event: MouseEvent): void {
  if (!props.title) return

  tooltipVisible.value = true
  const rect = (event.target as HTMLElement).getBoundingClientRect()
  
  // 使用requestAnimationFrame确保DOM更新完成后计算位置
  requestAnimationFrame(() => {
    const tooltip = document.querySelector('.tooltip.show')
    if (tooltip) {
      const tooltipRect = tooltip.getBoundingClientRect()
      tooltipPosition.value = {
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2 - tooltipRect.width / 2
      }
    }
  })
}

function hideTooltip(): void {
  tooltipVisible.value = false
}
</script>

<style scoped>
.icon-wrapper {
  position: relative;
  display: inline-block;
}

.icon {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  display: inline-block;
  vertical-align: middle;
}

/* Tooltip样式 */
.tooltip {
  position: fixed;
  background-color: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  z-index: 1000;
  pointer-events: none;
  transform: translateX(-50%);
}

.tooltip-arrow {
  position: absolute;
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 6px solid rgba(0, 0, 0, 0.9);
}
</style>