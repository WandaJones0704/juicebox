const { Client } = require("pg");
const client = new Client("postgres://localhost:5432/juicebox-dev");

async function createUser({ username, password, name, location }) {
  try {
    const {
      rows: [user],
    } = await client.query(
      `
      INSERT INTO users(username, password, name, location)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (username) DO NOTHING 
      RETURNING *;
    `,
      [username, password, name, location]
    );

    return user;
  } catch (error) {
    throw error;
  }
}

async function updateUser(id, fields = {}) {
  const setString = Object.keys(fields)
    .map((key, index) => `"${key}"=$${index + 1}`)
    .join(", ");
  if (setString.length === 0) {
    return;
  }

  try {
    const {
      rows: [user],
    } = await client.query(
      `
      UPDATE users
      SET ${setString}
      WHERE id=$${Object.keys(fields).length + 1}
      RETURNING *;
    `,
      [...Object.values(fields), id]
    );

    return user;
  } catch (error) {
    throw error;
  }
}

async function getAllUsers() {
  try {
    const { rows } = await client.query(
      `SELECT id, username , name, location, active
    FROM users;
  `
    );

    return rows;
  } catch (error) {
    throw error;
  }
}

async function createPost({ authorId, title, content }) {
  try {
    const {
      rows: [post],
    } = await client.query(
      `
      INSERT INTO posts("authorId", title, content) 
      VALUES($1, $2, $3)
      RETURNING *;
    `,
      [authorId, title, content]
    );

    return post;
  } catch (error) {
    throw error;
  }
}

async function updatePost(id, fields = {}) {
  console.log("fields" + JSON.stringify(fields));

  for (let key in fields) {
    if (key == "tags") {
      tags = fields[key];

      for (let i = 0; i < tags.length; i++) {
        tag = tags[i];

        tagId = await getTagId(tag);
        console.log("tag: " + tag + " tagId: " + tagId);

        try {
          await client.query(
            `
            INSERT INTO post_tags("postId", "tagId")
            VALUES (${id},${tagId});
            `
          );
        } catch (error) {
          throw error;
        }
      }
    } else {
      fieldName = key;
      fieldValue = fields[key];

      try {
        await client.query(
          `
          UPDATE posts
          SET  ${fieldName} = '${fieldValue}'
          `
        );
      } catch (error) {
        throw error;
      }

      //
    }
  }
}

async function getTagId(tag) {
  console.log("I am here");
  try {
    await client.query(
      `
      INSERT INTO tags(name)
      VALUES ('${tag}')
      ON CONFLICT (name) DO NOTHING
      RETURNING *;
      `
    );

    console.log("I am here 2");

    const { rows } = await client.query(
      `
    SELECT id
    FROM tags
    WHERE name = '${tag}';
    `
    );

    row = rows[0];

    tagId = row.id;

    return tagId;
  } catch (error) {
    throw error;
  }
}

async function getPostById(postId) {
  try {
    console.log("Post id " + postId);
    const { rows } = await client.query(
      `SELECT id, "authorId" , title, content, active
    FROM posts
    where id=${postId};
  `
    );

    post = rows[0]; // should only return 1 row

    console.log(post);

    return post;
  } catch (error) {
    throw error;
  }
}

async function getAllPosts() {
  try {
    const { rows: postIds } = await client.query(`
      SELECT id
      FROM posts;
    `);

    const posts = await Promise.all(postIds.map(({ id }) => getPostById(id)));

    return posts;
  } catch (error) {
    throw error;
  }
}
async function getPostsByUser(userId) {
  try {
    const { rows: postIds } = await client.query(
      `
      SELECT id 
      FROM posts
      WHERE "authorId"=$1;
    `[userId]
    );

    const posts = await Promise.all(postIds.map(({ id }) => getPostById(id)));

    return posts;
  } catch (error) {
    throw error;
  }
}

async function getUserById(userId) {
  try {
    const {
      rows: [user],
    } = await client.query(`
      SELECT id, username, name, location, active
      FROM users
      WHERE id=${userId}
    `);

    if (!user) {
      return null;
    }

    user.posts = await getPostsByUser(userId);

    return user;
  } catch (error) {
    throw error;
  }
}

async function createTags(tagList) {
  if (tagList.length === 0) {
    return;
  }
  const insertValues = tagList.map((_, index) => `$${index + 1}`).join("), (");

  const selectValues = tagList.map((_, index) => `$${index + 1}`).join(", ");

  try {
    await client.query(
      `
      INSERT INTO tags(name)
      VALUES (${insertValues});
      ON CONFLICT (name) DO NOTHING;
      RETURNING *;
      `,
      tagList
    );

    const { rows } = await client.query(
      `   
    SELECT *
    FROM tags
    WHERE name
    IN (${selectValues});
    `,
      tagList
    );

    return rows;
  } catch (error) {
    throw error;
  }
}

async function createPostTag(postId, tagId) {
  try {
    await client.query(
      `
      INSERT INTO post_tags("postId", "tagId")
      VALUES ($1, $2)
      ON CONFLICT ("postId", "tagId") DO NOTHING;
    `,
      [postId, tagId]
    );
  } catch (error) {
    throw error;
  }
}

async function addTagsToPost(postId, tagList) {
  try {
    const createPostTagPromises = tagList.map((tag) =>
      createPostTag(postId, tag.id)
    );

    await Promise.all(createPostTagPromises);

    return await getPostById(postId);
  } catch (error) {
    throw error;
  }
}

module.exports = {
  client,
  getAllUsers,
  createUser,
  updateUser,
  getUserById,
  createPost,
  updatePost,
  getAllPosts,
  getPostsByUser,
  createTags,
  addTagsToPost,
};
