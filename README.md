# 경영전략그룹 Daily To do List

A beautiful and intuitive task management application for teams.

## Features

- ✅ **Task Management**: Add, edit, and delete tasks with status tracking
- 👥 **Multiple Assignees**: Assign multiple team members to a single task
- 📝 **Action Items**: Add detailed action items to each task
- 💬 **Comments**: Comment system with replies and emoji reactions
- 🎨 **Beautiful UI**: Pastel purple theme with responsive design
- 💾 **Data Export/Import**: Export and import tasks as JSON files
- 📱 **Mobile Friendly**: Works on both desktop and mobile devices

## Deployment Options

### Option 1: GitHub Pages (Recommended - Free)

1. Create a GitHub account at https://github.com if you don't have one
2. Create a new repository named `todo-app` or any name you prefer
3. Upload all files (index.html, styles.css, app.js) to the repository
4. Go to Settings → Pages
5. Under "Source", select "main" branch and click Save
6. Your site will be available at: `https://YOUR_USERNAME.github.io/REPO_NAME/`

### Option 2: Netlify (Free)

1. Go to https://www.netlify.com and sign up
2. Click "Add new site" → "Deploy manually"
3. Drag and drop the `todo-app` folder
4. Your site will be instantly available with a Netlify URL
5. You can customize the URL in Site settings

### Option 3: Vercel (Free)

1. Go to https://vercel.com and sign up
2. Click "New Project"
3. Import your GitHub repository or upload files
4. Your site will be deployed automatically

## Usage

### Adding Tasks
1. Enter task name, status, priority, and due date
2. Click the assignee dropdown to select multiple team members
3. Click "업무 추가" to add the task

### Managing Assignees
1. Click the ⚙️ button next to the assignee dropdown
2. Add, edit, or delete team member names
3. Changes are saved automatically

### Sharing Data with Team
1. Click "📤 내보내기" to download tasks as JSON
2. Share the JSON file with team members
3. Team members can click "📥 가져오기" to import the data

## File Structure

```
todo-app/
├── index.html    # Main HTML structure
├── styles.css    # Styling with pastel purple theme
├── app.js        # Application logic
└── README.md     # This file
```

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers

## Data Storage

All data is stored in your browser's localStorage. This means:
- ✅ Data persists across browser sessions
- ✅ Works offline
- ⚠️ Data is local to each device/browser
- ⚠️ Clearing browser data will delete all tasks

To share data between team members, use the Export/Import feature.

## License

Feel free to use and modify for your team's needs.

---

Created for 경영전략그룹