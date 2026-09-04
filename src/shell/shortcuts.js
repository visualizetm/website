/* Every keyboard shortcut the admin listens for, grouped by screen (Prompt 12).
 * The Call Console overlay and the Settings Shortcuts tab both render this. */
export const SHORTCUT_GROUPS = [
  { id: 'shell', label: 'Everywhere', keys: [['/', 'Open the command bar'], ['Cmd or Ctrl + K', 'Open the command bar'], ['Esc', 'Close the sheet, modal, or menu']] },
  { id: 'command', label: 'Command bar', keys: [['Up and Down', 'Move through results'], ['Enter', 'Open the result'], ['Digits', 'Search by phone number']] },
  { id: 'calls', label: 'Call Console', keys: [['1', 'Booked'], ['2', 'Callback'], ['3', 'No answer'], ['4', 'Said no'], ['5', 'Wrong number'], ['N', 'Next lead'], ['S', 'Skip'], ['Right or Space', 'Next'], ['Left', 'Previous'], ['Esc', 'Back to the queue'], ['?', 'Shortcut list']] },
  { id: 'calendar', label: 'Calendar', keys: [['Left and Right', 'Previous and next period'], ['T', 'Today'], ['D', 'Day view'], ['W', 'Week view'], ['M', 'Month view']] },
  { id: 'tables', label: 'Tables and lists', keys: [['Enter', 'Open the focused row'], ['Tab', 'Move between controls']] },
];
