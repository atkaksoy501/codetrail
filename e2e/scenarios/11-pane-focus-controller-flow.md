# Pane Focus Controller Flow

## Goal
Verify that pane focus is restored from app-level views and overlays, and that pane chrome no longer drops or desynchronizes history-pane focus.

## Steps
1. Activate the Sessions pane, open global search, press `Escape`, and confirm the Sessions pane is still the active pane and its list has focus.
2. Activate the Projects pane, open settings, press `Escape`, and confirm the Projects pane is still the active pane and its list has focus.
3. Activate the Messages pane, open help, close it from the toolbar, and confirm the Messages pane is still the active pane and its list has focus.
4. Activate the Projects pane, click empty space in the project header and provider row, and confirm the Projects pane stays active.
5. With the Projects pane active, click the top-bar refresh button and confirm the Projects pane stays active.
6. Open and dismiss the project sort menu, then the theme menu, and confirm focus returns to the previously active Projects pane after each overlay closes.
7. Activate the Sessions pane by clicking its header background and confirm it becomes the active pane.
