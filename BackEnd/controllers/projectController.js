const db = require('../config/db');

// GET all projects
exports.getAllProjects = (req, res) => {
  const sql = 'SELECT * FROM Projects';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching projects:', err);
      return res.status(500).send('Error fetching projects');
    }
    res.json(results);
  });
};

// GET a specific project by ProjectID
exports.getProjectById = (req, res) => {
  const projectId = req.params.id;
  const sql = 'SELECT * FROM Projects WHERE ProjectID = ?';
  db.query(sql, [projectId], (err, result) => {
    if (err) {
      console.error('Error fetching project:', err);
      return res.status(500).send('Error fetching project');
    }
    if (result.length === 0) {
      return res.status(404).send('Project not found');
    }
    res.json(result[0]);
  });
};

// POST a new project
// Update createProject to validate quote relationship
exports.createProject = async (req, res) => {
  try {
      const { QuoteID, ProjectStartDate, ProjectEndDate, Status } = req.body;

      // Validate QuoteID exists
      const [quoteExists] = await db.query(
          'SELECT QuoteID FROM Quotes WHERE QuoteID = ?',
          [QuoteID]
      );

      if (quoteExists.length === 0) {
          return res.status(404).send('Quote not found');
      }

      const newProject = {
          QuoteID,
          ProjectStartDate,
          ProjectEndDate,
          Status
      };

      const [result] = await db.query('INSERT INTO Projects SET ?', newProject);
      
      // Update quote status when project is created
      await db.query(
          'UPDATE Quotes SET Status = ? WHERE QuoteID = ?',
          ['In Progress', QuoteID]
      );

      res.json({ 
          message: 'Project created', 
          projectId: result.insertId 
      });

  } catch (error) {
      console.error('Error creating project:', error);
      res.status(500).send('Error creating project');
  }
};

// PUT to update a project
exports.updateProject = (req, res) => {
  const projectId = req.params.id;
  const updatedProject = req.body;
  const sql = 'UPDATE Projects SET ? WHERE ProjectID = ?';
  db.query(sql, [updatedProject, projectId], (err, result) => {
    if (err) {
      console.error('Error updating project:', err);
      return res.status(500).send('Error updating project');
    }
    if (result.affectedRows === 0) {
      return res.status(404).send('Project not found');
    }
    res.send('Project updated');
  });
};

// DELETE a project by ProjectID
exports.deleteProject = (req, res) => {
  const projectId = req.params.id;
  const sql = 'DELETE FROM Projects WHERE ProjectID = ?';
  db.query(sql, [projectId], (err, result) => {
    if (err) {
      console.error('Error deleting project:', err);
      return res.status(500).send('Error deleting project');
    }
    if (result.affectedRows === 0) {
      return res.status(404).send('Project not found');
    }
    res.send('Project deleted');
  });
};
